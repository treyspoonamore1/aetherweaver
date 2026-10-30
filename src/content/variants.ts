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
    cost: 25,
    values: { radius: 6, pct: 17, flat: 70, seconds: 3 },
    text: 'A burst around the hero you Ward: every hero within {radius} m gets a barrier of {pct}% of their life + {flat}, for {seconds} s. The one you Ward is Perfect as a Ward is. It costs more Spirit.',
  },
  {
    id: 'aegis_link',
    slot: 'ward',
    name: 'Aegis Link',
    values: { seconds: 5, pct: 33 },
    text: 'Link the hero you Ward with the hero you Thread (or the one nearest them) for {seconds} s: what hits either is {pct}% lighter, and split evenly between them. Perfect when the first hit lands on either in time: it’s negated, and you join the link, three ways.',
  },
  // ── Chime (E) ─────────────────────────────────────────────────────────────────────────
  {
    id: 'purge',
    slot: 'chime',
    name: 'Purge',
    values: { radius: 3.5, pct: 75, share: 35 },
    text: 'What the Chime cleanses bursts out at every enemy within {radius} m of the hero: a Dirge as {pct}% of its damage, a silence, stun or sleep for {share}% of the time it had left.',
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
    values: { pct: 50, seconds: 2 },
    text: 'Trade places with the hero you Thread, at once. You take what was coming for them, behind a barrier of {pct}% of their life for {seconds} s.',
  },
  {
    id: 'anchor',
    slot: 'reel',
    name: 'Anchor',
    values: { seconds: 3, pct: 50 },
    text: 'The hero you Thread takes {pct}% less damage for {seconds} s.',
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
    cooldown: 5,
    values: { charges: 2, metres: 4 },
    text: '{charges} charges of a {metres} m dash. They come back one at a time, each after the cooldown.',
  },
];
