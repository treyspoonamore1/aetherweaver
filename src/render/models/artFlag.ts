/**
 * How large the heroes and the Weaver are drawn (the owner's choice, Phase 8b: 1.12×). The model
 * only (ModelBatch.drawn): their rings, radii, footprints, reach, hit shapes and every effect
 * placed by their content height are unchanged.
 */
export const HERO_DRAWN = 1.12;

/**
 * Readability rule 5 (the rank-and-file hostile rim) and the elite's gold, as the owner chose them
 * (Phase 8c, docs/phase-8.md 8b: "Red outline, no wash"): both constants on. The outline carries
 * the standing rim (red on a rank-and-file foe, gold on an elite and its crown) and the body takes
 * the hostile red at its edge only. The Weaver's own resting rim is not a hostile rim and is not
 * governed by either: on her body, her outline dark lead.
 *
 * The earlier looks are still built by turning a constant off, and the studio draws all four
 * without a rebuild (`hostile: 'flat' | 'edge' | 'outline' | 'outline-edge'`).
 *
 * HOSTILE_EDGE: on, the hostile rim on a stained-glass foe keeps to its silhouette's edge (a
 * sharper, brighter fresnel); off, it also washes the whole body in a faint flat red, which turns
 * a dark body red. Only the hostile rim: every aura, effect and elite rim is drawn as before.
 */
export const HOSTILE_EDGE = true;

/**
 * HOSTILE_OUTLINE: on, the outline shell carries the two standing rims too (the rank-and-file
 * hostile rim and the elite's gold, with its crown's glow), as it carries every event cue, so a
 * foe's outline is red and an elite's gold; off, those two rims are drawn on the body only and the
 * outline stays dark lead. With HOSTILE_EDGE as well (the game's look): a red outline with no body
 * wash.
 */
export const HOSTILE_OUTLINE = true;
