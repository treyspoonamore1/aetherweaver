/**
 * Phase 5g, W5 (docs/phase-5g.md, "Harmonies"): Woven Aegis, Cutting Chorus, Guardian's Cadence,
 * Spindle Lullaby, Tempo Rubato, Concert Pitch, Grand Staff, Crossed Steel, Wounded Healer and
 * Closed Circle. Each is rarity `epic`, one level, tagged `harmony`, carries
 * `requires.expedition`, and names its prerequisites in `requires.motifs` (the content lint
 * checks each names a motif) and any hero or aura gate in `requires.hero` / `requires.aura`.
 * Appended to `CONTENT.motifs` after the Finale fill, last. Their resolver cases and hook bodies
 * (N19-N23, and Cutting Chorus's and Spindle Lullaby's parts of N1) are in
 * `src/sim/fill/harmonies.ts`; Guardian's Cadence and Crossed Steel are triggers
 * (sim/systems/triggers.ts). Cutting Chorus and Spindle Lullaby are offered only with their aura
 * slotted (`requires.aura`), and the sim checks again, at the time of use, that it is in the
 * songs; neither changes the aura. The fixed numbers in a text (4 s, 8 s) are the sim's
 * constants (`RINGING_SECONDS`, `LULLABY_EVERY`); the Harmonies' tests check they match.
 */
import type { ContentInput } from '../schema';

export const FILL_HARMONIES: ContentInput['motifs'] = [
  {
    id: 'woven_aegis',
    name: 'Woven Aegis',
    category: 'aegis',
    rarity: 'epic',
    values: [30],
    text: 'Mend on a hero your Ward is on also refills the Ward by {v}% of the healing.',
    requires: { motifs: ['warded_weft', 'lingering_aegis'], expedition: true },
    tags: ['harmony', 'thread', 'heal', 'ward', 'shield'],
  },
  {
    id: 'cutting_chorus',
    name: 'Cutting Chorus',
    category: 'silk',
    rarity: 'epic',
    values: [100],
    text: 'With Fortissimo in your songs, Razor Silk deals {v}% more damage and can strike critically.',
    requires: { aura: 'fortissimo', motifs: ['razor_silk'], expedition: true },
    tags: ['harmony', 'thread', 'damage', 'razor'],
  },
  {
    id: 'guardians_cadence',
    name: 'Guardian’s Cadence',
    category: 'bond',
    rarity: 'epic',
    values: [50],
    text: 'Kael’s Shield Bash sets off Riposte Bloom around him at {v}% strength.',
    requires: { hero: 'kael', motifs: ['iron_answer', 'riposte_bloom'], expedition: true },
    tags: ['harmony', 'perfect', 'damage'],
    triggers: [
      {
        on: 'abilityUsed',
        hero: 'kael',
        ability: 'shieldBash',
        effects: [{ kind: 'damage', amount: 'v', of: 'riposte', at: 'event', radius: 4 }],
      },
    ],
  },
  {
    id: 'spindle_lullaby',
    name: 'Spindle Lullaby',
    category: 'silk',
    rarity: 'epic',
    values: [1],
    text: 'With Lullaby in your songs, ordinary enemies touching your Thread fall asleep for {v} s, once per enemy every 8 s.',
    requires: { aura: 'lullaby', motifs: ['razor_silk'], expedition: true },
    tags: ['harmony', 'thread', 'control', 'razor'],
  },
  {
    id: 'tempo_rubato',
    name: 'Tempo Rubato',
    category: 'finale',
    rarity: 'epic',
    values: [3],
    text: 'One Cue in every {v} costs no Resonance.',
    requires: { motifs: ['canon', 'opening_bars'], expedition: true },
    tags: ['harmony', 'cue', 'resonance'],
  },
  {
    id: 'concert_pitch',
    name: 'Concert Pitch',
    category: 'aegis',
    rarity: 'epic',
    values: [15],
    text: 'A Perfect Ward rings out: every hero deals {v}% more damage for 4 s.',
    requires: { motifs: ['steady_hands', 'thread_the_needle'], expedition: true },
    tags: ['harmony', 'ward', 'perfect', 'damage'],
  },
  {
    id: 'grand_staff',
    name: 'Grand Staff',
    category: 'finale',
    rarity: 'epic',
    values: [100],
    text: 'Empowered heroes’ Solos charge {v}% faster.',
    requires: { motifs: ['golden_filament', 'call_and_response'], expedition: true },
    tags: ['harmony', 'thread', 'solo'],
  },
  {
    id: 'crossed_steel',
    name: 'Crossed Steel',
    category: 'bond',
    rarity: 'epic',
    values: [2],
    text: 'Each parry Seren makes brings your Ward {v} s closer.',
    requires: { hero: 'seren', motifs: ['en_garde', 'second_intention'], expedition: true },
    tags: ['harmony', 'ward'],
    triggers: [
      {
        on: 'parried',
        hero: 'seren',
        effects: [{ kind: 'cooldown', techniques: ['ward'], seconds: 'v' }],
      },
    ],
  },
  {
    id: 'wounded_healer',
    name: 'Wounded Healer',
    category: 'silk',
    rarity: 'epic',
    values: [25],
    text: 'While you are below half your Life, Mend heals {v}% more and your Wards are {v}% larger.',
    requires: { motifs: ['kindred_wound', 'saving_grace'], expedition: true },
    tags: ['harmony', 'thread', 'heal', 'ward', 'lowlife'],
  },
  {
    id: 'closed_circle',
    name: 'Closed Circle',
    category: 'choir',
    rarity: 'epic',
    values: [10],
    text: 'While every hero stands in your field, they take {v}% less damage.',
    requires: { motifs: ['massed_voices', 'close_harmony'], expedition: true },
    tags: ['harmony', 'field'],
  },
];
