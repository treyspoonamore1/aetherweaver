/**
 * How large the heroes and the Weaver are drawn (the owner's choice, Phase 8b: 1.12×). The model
 * only (ModelBatch.drawn): their rings, radii, footprints, reach, hit shapes and every effect
 * placed by their content height are unchanged.
 */
export const HERO_DRAWN = 1.12;

/**
 * The height a figure is drawn at, for a mark placed over its head: its content height times how
 * large its model is drawn (`ModelBatch.drawn`: HERO_DRAWN for a hero and the Weaver, 1 for an
 * enemy or a summon). For the marks that sit over heroes and enemies alike (a damage number, the
 * stun stars): over a hero they keep their clearance over the drawn head, over an enemy they stay
 * where they were. A record with no model is taken at its own height.
 */
export function drawnHeight(r: { height: number; batch?: { drawn: number } }): number {
  return r.height * (r.batch?.drawn ?? 1);
}

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

/**
 * How strongly the outline carries the hostile red under the game's look (both constants above
 * on): 1 is the outline as the owner chose it (the body's edge-only rim at a fresnel of 1). Lower
 * it and only a rank-and-file foe's outline dims toward lead; its body's edge, the elite's gold
 * and every event cue are untouched. Kept at 1 after it was measured against the telegraphs at
 * 0.7 and 0.45 (docs/phase-8.md, 8b): a dimmer red sits nearer a lethal telegraph's fill, and a
 * figure standing on one separates from it less.
 */
export const HOSTILE_OUTLINE_STRENGTH: number = 1;

/**
 * How strongly the outline carries the elite's gold, and its crown's (with HOSTILE_OUTLINE): 1 is
 * the body's own rim at a fresnel of 1, the outline as the owner first saw it. Lower it and only
 * an elite's outline and its crown's dim toward lead: its body's gold, Focus's gold on any foe
 * and every other cue are untouched. Set to 0.6 after it was measured (docs/phase-8.md, 8b): at 1
 * an elite's outline and a Focused foe's were the same gold, 14 to 21 ΔE apart (72 to 83 with the
 * dark outline); at 0.6 they are 27 to 34 apart and the elite's outline is still gold. 1 restores
 * the outline as first seen.
 */
export const ELITE_OUTLINE_STRENGTH: number = 0.6;
