import type { ContentInput } from './schema';

/**
 * The Loom's economy and keepsakes (docs/phase-4g.md): Starlight, what the Atelier sells, and
 * Calling mastery. Colours are the views'; the sim never reads them.
 */
export const STARLIGHT: ContentInput['starlight'] = {
  /** A won fight pays by its kind; a lost one pays nothing. */
  fights: { skirmish: 3, elite: 6, miniboss: 10, boss: 20 },
  /** A won run, on top. */
  winBonus: 15,
  /** The ladder's Deeds, easiest first, then every badge. */
  deedLadder: [10, 12, 14, 16, 20, 24, 28, 32, 36, 40],
  deedBadge: 15,
  /** The Atelier opens at this Weaver Rank. */
  atelierRank: 5,
  variantPrice: 120,
};

export const COSMETICS: ContentInput['cosmetics'] = {
  robes: [
    {
      id: 'robe_dusk',
      name: 'Dusk',
      price: 60,
      colors: { body: '#3b2f5c', trim: '#c4a7ff', glow: '#a78bfa' },
    },
    {
      id: 'robe_ember',
      name: 'Ember',
      price: 70,
      colors: { body: '#5c2a1e', trim: '#fdba74', glow: '#fb923c' },
    },
    {
      id: 'robe_tide',
      name: 'Tide',
      price: 70,
      colors: { body: '#163b4a', trim: '#7dd3fc', glow: '#38bdf8' },
    },
    {
      id: 'robe_bone',
      name: 'Bone and Gold',
      price: 90,
      colors: { body: '#e7e0cf', trim: '#d4a64a', glow: '#fde68a' },
    },
  ],
  threads: [
    { id: 'thread_silver', name: 'Silver', price: 60, filament: '#e2e8f0', glow: '#cbd5e1' },
    { id: 'thread_rose', name: 'Rose', price: 70, filament: '#fda4af', glow: '#fb7185' },
    { id: 'thread_starlit', name: 'Starlit', price: 90, filament: '#c7d2fe', glow: '#818cf8' },
  ],
  titles: [
    { id: 'title_steady_hand', text: 'Steady Hand', price: 40 },
    { id: 'title_quiet_bell', text: 'the Quiet Bell', price: 40 },
    { id: 'title_threadbare', text: 'Threadbare and Unbowed', price: 40 },
    { id: 'title_lightbearer', text: 'Lightbearer', earned: { mastery: 'luminary' } },
    { id: 'title_unbroken', text: 'the Unbroken Vow', earned: { mastery: 'martyr' } },
    { id: 'title_keeper', text: 'Keeper of Hours', earned: { mastery: 'chronomancer' } },
    { id: 'title_flawless', text: 'Flawless', earned: { deed: 'flawless' } },
  ],
};

export const MASTERY: ContentInput['mastery'] = {
  /** Mastery XP for each level: level 1 opens tier I, levels 2–4 tiers II–IV. */
  levels: [0, 150, 450, 900, 1500],
  /** Each Calling's top mastery: its title, and the variant it opens in the Atelier. */
  callings: [
    { calling: 'luminary', variant: 'chorale', title: 'title_lightbearer' },
    { calling: 'martyr', variant: 'aegis_link', title: 'title_unbroken' },
    { calling: 'chronomancer', variant: 'phase_step', title: 'title_keeper' },
  ],
};
