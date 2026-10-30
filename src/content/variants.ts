import type { ContentInput } from './schema';

/**
 * The Weaver's technique variants (docs/phase-4f.md, plan 03 §1): two per slot, chosen in Prep.
 * The text is built from `values`; `cost` and `cooldown` replace the default's where given.
 */
export const TECHNIQUE_VARIANTS: ContentInput['techniqueVariants'] = [
  // ── Ward (Q) ──────────────────────────────────────────────────────────────────────────
  {
    id: 'chorale',
    slot: 'ward',
    name: 'Chorale',
    values: { radius: 6, pct: 14, flat: 60, seconds: 2.5 },
    text: 'A burst around the hero you Ward: every hero within {radius} m gets a barrier of {pct}% of their life + {flat}, for {seconds} s. Perfect when one attack strikes two of them in time: those hits are negated.',
  },
  {
    id: 'aegis_link',
    slot: 'ward',
    name: 'Aegis Link',
    values: { seconds: 4 },
    text: 'Link the hero you Ward with the hero you Thread (or the one nearest them) for {seconds} s: damage to either is split evenly between them. Perfect when a hit lands on either in time: it’s negated, and you join the link, three ways.',
  },
  // ── Chime (E) ─────────────────────────────────────────────────────────────────────────
  {
    id: 'purge',
    slot: 'chime',
    name: 'Purge',
    values: { radius: 5, pct: 150 },
    text: 'What the Chime cleanses bursts out at every enemy within {radius} m of the hero: a Dirge as {pct}% of its damage, a silence, stun or sleep for the time it had left.',
  },
  {
    id: 'absolve',
    slot: 'chime',
    name: 'Absolve',
    cooldown: 14,
    values: { heal: 25, seconds: 2, pct: 25 },
    text: 'The Chime heals {heal}% of their life and leaves {seconds} s of {pct}% less damage taken. A longer cooldown.',
  },
  // ── Reel (F) ──────────────────────────────────────────────────────────────────────────
  {
    id: 'swap',
    slot: 'reel',
    name: 'Swap',
    values: {},
    text: 'Trade places with the hero you Thread, at once. You take what was coming for them.',
  },
  {
    id: 'anchor',
    slot: 'reel',
    name: 'Anchor',
    values: { seconds: 2.5, pct: 40 },
    text: 'The hero you Thread takes {pct}% less damage for {seconds} s, and nothing moves them.',
  },
  // ── Glide (Space) ─────────────────────────────────────────────────────────────────────
  {
    id: 'phase_step',
    slot: 'glide',
    name: 'Phase Step',
    values: { metres: 8, seconds: 2 },
    text: 'Blink {metres} m at once. Enemies hunting you lose you for {seconds} s and turn on the nearest hero; a decoy of you lingers where you were.',
  },
  {
    id: 'skate',
    slot: 'glide',
    name: 'Skate',
    cooldown: 4,
    values: { charges: 2, metres: 4 },
    text: 'Two charges of a {metres} m dash, each back after its cooldown.',
  },
];
