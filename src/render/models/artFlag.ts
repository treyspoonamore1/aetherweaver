/**
 * How large the heroes and the Weaver are drawn (the owner's choice, Phase 8b: 1.12×). The model
 * only (ModelBatch.drawn): their rings, radii, footprints, reach, hit shapes and every effect
 * placed by their content height are unchanged.
 */
export const HERO_DRAWN = 1.12;

/**
 * An alternative for readability rule 5 (the rank-and-file hostile rim), built for the owner to
 * judge and off: on, the rim on a stained-glass foe keeps to its silhouette's edge (a sharper,
 * brighter fresnel) instead of also washing the whole body in a faint flat red, which turns a dark
 * body red. Only the hostile rim: every aura, effect and elite rim is drawn as before.
 */
export const HOSTILE_EDGE = false;

/**
 * Another alternative for the owner, off: on, the outline shell carries the two standing rims too
 * (the rank-and-file hostile rim and the elite's gold), as it carries every event cue, so a foe's
 * outline is red and an elite's gold. Off (as approved), those two rims are drawn on the body only
 * and the outline stays dark lead. With HOSTILE_EDGE as well: a red outline with no body wash.
 */
export const HOSTILE_OUTLINE = false;
